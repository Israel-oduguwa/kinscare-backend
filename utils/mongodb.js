import { MongoClient } from 'mongodb'
import 'dotenv/config'
let uri = process.env.MONGODB_URI;
// let uri = process.env.MONGODEV; //test db
let dbName = "kinshealth";
// mongodb+srv://israeloduguwa:adeboyega@zororo-cluster.ruky4.mongodb.net/kinshealth
let cachedClient = null
let cachedDb = null

if (!uri) {
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env.local'
    )
}

if (!dbName) {
    throw new Error(
        'Please define the MONGODB_DB environment variable inside .env.local'
    )
}

export async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb }
    }

    const client = await MongoClient.connect(uri, {
        // Because of the update in version I do not need the useUnifiedTopology
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
    })

    const db = client.db(dbName)

    cachedClient = client
    cachedDb = db

    return { client, db }
}