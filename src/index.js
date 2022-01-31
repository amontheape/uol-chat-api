import express, { json } from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import joi from 'joi';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(cors());
app.use(json());

async function dbConnect() {
  const mongoClient = new MongoClient(process.env.DB_URI);

  try {
    const connectedClient = await mongoClient.connect();
    const dataBase = connectedClient.db(process.env.DB_NAME);
    console.log(`Connected to database`);
    return { mongoClient, dataBase };
  } catch (err) {
    console.log(
      `Connection ERROR: 
      ${err}`
    );
  }
}

const userSchema = joi.object({
  name: joi.string().required(),
})

app.post('/participants', async (req, res) => {
  const validation = userSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    res.status(422).send(validation.error.details.map(err => err.message));
    return;
  }

  try {
    const { mongoClient, dataBase } = await dbConnect();

    const unavailable = await dataBase
      .collection(process.env.USER_COLLECTION)
      .findOne( { name: req.body.name } );

    if(!unavailable){
      await dataBase
        .collection(process.env.USER_COLLECTION)
        .insertOne({ name: req.body.name, lastStatus: Date.now() });
  
      res.sendStatus(201) 
      mongoClient.close();
    } else {
      res.status(409).send("Este nome já está em uso");
    }  
  } catch (err) {
    res.sendStatus(500);
    console.log(
      `Creation ERROR:
      ${err}`
    );
  }
});

app.listen(5000);