import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dbClient);

export const handler = async () => {
  try {
    const command = new ScanCommand({ TableName: process.env.DYNAMODB_TABLE });
    const { Items } = await docClient.send(command);

    const productData = await axios.get(`${process.env.FAKE_STORE_API}/products`);

    return {
      statusCode: 200,
      body: JSON.stringify({ products: Items, fakeStore: productData.data }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};
