import express from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TABLE_NAME = process.env.TABLE_NAME;
const AWS_REGION = process.env.AWS_REGION;

if (!TABLE_NAME || !AWS_REGION) {
  console.error('Missing required environment variables TABLE_NAME or AWS_REGION');
  process.exit(1);
}

const client = new DynamoDBClient({ region: AWS_REGION });
const db = DynamoDBDocumentClient.from(client);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

app.get('/items', async (req, res) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk and begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'LIST',
        ':skPrefix': 'ITEM#'
      }
    };
    const command = new QueryCommand(params);
    const data = await db.send(command);
    const items = (data.Items || []).map(item => ({
      id: item.sk.replace('ITEM#', ''),
      text: item.text,
      createdAt: item.createdAt
    }));
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/items', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text' });
    }
    const id = randomUUID();
    const item = {
      pk: 'LIST',
      sk: 'ITEM#' + id,
      text: text,
      createdAt: new Date().toISOString()
    };
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    });
    await db.send(command);
    res.status(201).json({ id: id, text: text, createdAt: item.createdAt });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.delete('/items/' + ':id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: 'LIST',
        sk: 'ITEM#' + id
      }
    });
    await db.send(command);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server listening on port 3000');
});
