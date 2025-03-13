import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import serverless from 'serverless-http';

// Load environment variables
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up DynamoDB client
const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dbClient);
const tableName = process.env.DYNAMODB_TABLE;

// Add a product
app.post('/api/products', async (req, res) => {
  try {
    const { id, name, quantity, price } = req.body;
    if (!id || !name || !quantity || !price) {
      return res.status(400).json({ error: 'All fields (id, name, quantity, price) are required' });
    }

    const command = new PutCommand({
      TableName: tableName,
      Item: { id, name, quantity, price },
    });

    await docClient.send(command);
    res.status(201).json({ message: 'Product added successfully' });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Could not add product', details: error.message });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: tableName });
    const { Items } = await docClient.send(command);
    res.status(200).json(Items);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Could not fetch products' });
  }
});

// Update a product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, price } = req.body;

    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET #n = :name, #q = :quantity, #p = :price',
      ExpressionAttributeNames: { '#n': 'name', '#q': 'quantity', '#p': 'price' },
      ExpressionAttributeValues: { ':name': name, ':quantity': quantity, ':price': price },
      ReturnValues: 'ALL_NEW',
    });

    const { Attributes } = await docClient.send(command);
    res.status(200).json({ message: 'Product updated', product: Attributes });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Could not update product', details: error.message });
  }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const command = new DeleteCommand({
      TableName: tableName,
      Key: { id },
    });

    await docClient.send(command);
    res.status(200).json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Could not delete product', details: error.message });
  }
});

// Fetch products from Fake Store API
app.get('/api/fake-products', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.FAKE_STORE_API}/products`);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching fake products:', error.message);
    res.status(500).json({ error: 'Failed to fetch products from Fake Store API' });
  }
});

// Save Fake Store products to DynamoDB
app.post('/api/fake-products', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.FAKE_STORE_API}/products`);
    const products = response.data;

    const putRequests = products.map((product) =>
      new PutCommand({
        TableName: tableName,
        Item: {
          id: product.id.toString(),
          name: product.title,
          price: product.price,
          category: product.category,
          description: product.description,
          image: product.image,
        },
      })
    );

    for (const command of putRequests) {
      await docClient.send(command);
    }

    res.status(201).json({ message: 'Fake Store products saved to DynamoDB!' });
  } catch (error) {
    console.error('Error saving fake products:', error.message);
    res.status(500).json({ error: 'Failed to save products', details: error.message });
  }
});

// Helper function: Check and update prices
async function checkAndUpdatePrices() {
  try {
    console.log("📦 Fetching products from Fake Store API...");
    const response = await axios.get(`${process.env.FAKE_STORE_API}/products`);
    const products = response.data;

    for (const product of products) {
      const { id, title: name, price } = product;

      console.log(`🔎 Checking product: ${name} (ID: ${id}, Price: ${price})`);

      const currentRecord = await docClient.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: "id = :id",
          ExpressionAttributeValues: { ":id": id.toString() },
        })
      );

      if (currentRecord.Items.length > 0) {
        const existingProduct = currentRecord.Items[0];

        if (existingProduct.price !== price) {
          console.log(`🔔 Price changed: ${name} (Old: $${existingProduct.price}, New: $${price})`);

          await docClient.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { id: id.toString() },
              UpdateExpression: "SET price = :newPrice",
              ExpressionAttributeValues: { ":newPrice": price },
            })
          );
        }
      }
    }

    console.log("✅ Price check completed.");
  } catch (error) {
    console.error("❌ Error checking prices:", error.message);
  }
}

// Trigger manual price check
app.post("/api/check-prices", async (req, res) => {
  await checkAndUpdatePrices();
  res.status(200).json({ message: "Price check triggered." });
});

// Root Route
app.get('/', (req, res) => {
  res.send('✅ Smart Inventory Tracker Backend is running!');
});

// Handle EventBridge trigger
export async function eventHandler(event) {
  console.log("🚀 Event Received:", JSON.stringify(event, null, 2));
  if (event.action === "monitorPrices") {
    console.log("EventBridge: Checking product prices...");
    await checkAndUpdatePrices();
  } else {
    console.log("❓ Unknown event received.");
  }
}

// Start the server (for local testing)
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

// Export Lambda handler
export const handler = serverless(app);