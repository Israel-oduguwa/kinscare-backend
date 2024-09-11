import { MongoClient } from "mongodb";

// Replace with your actual MongoDB credentials and URLs
const prodUri = "mongodb://israeloduguwa:adeboyega@zororo-cluster-shard-00-00.ruky4.mongodb.net:27017,zororo-cluster-shard-00-01.ruky4.mongodb.net:27017,zororo-cluster-shard-00-02.ruky4.mongodb.net:27017/?ssl=true&replicaSet=atlas-wkxcm3-shard-0&authSource=admin&retryWrites=true&w=majority";
const devUri = "mongodb+srv://kinscaredeveloper:8ZMNldxvR7Wsleru@cluster0.ruky4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Production and development database names
const prodDbName = 'kinshealth'; // Replace with your production database name
const devDbName = 'kinscaredev';   // Replace with your development database name

// List of collections to copy
const collections = [
  'contacts',
  'csrf_tokens',
  'jobs',
  'notifications',
  'posts',
  'threads',
  'trials_track',
  'twilio_chat',
  'users'
];

async function copyCollections() {
  // Initialize clients for both production and development databases
  const prodClient = new MongoClient(prodUri, { useNewUrlParser: true, useUnifiedTopology: true });
  const devClient = new MongoClient(devUri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Connect to both production and development databases
    await prodClient.connect();
    await devClient.connect();

    console.log('Connected to both production and development databases.');

    // Reference to the production and development databases
    const prodDb = prodClient.db(prodDbName);
    const devDb = devClient.db(devDbName);
    console.log(devDb)

    // Loop through each collection and copy its data to the development database
    // for (const collectionName of collections) {
    //   console.log(`Copying collection: ${collectionName}`);

    //   // Fetch all documents from the production collection
    //   const prodCollection = prodDb.collection(collectionName);
    //   const documents = await prodCollection.find({}).toArray();

    //   if (documents.length > 0) {
    //     // Insert documents into the corresponding collection in the development database
    //     const devCollection = devDb.collection(collectionName);
    //     await devCollection.insertMany(documents);

    //     console.log(`Successfully copied collection: ${collectionName} with ${documents.length} documents.`);
    //   } else {
    //     console.log(`No documents found in collection: ${collectionName}, nothing to copy.`);
    //   }
    // }

    console.log('All collections copied successfully!');
  } catch (error) {
    console.error('Error copying collections:', error);
  } finally {
    // Close connections to both databases
    await prodClient.close();
    await devClient.close();
    console.log('Closed all database connections.');
  }
}

// Run the copy function
copyCollections().catch(console.error);
