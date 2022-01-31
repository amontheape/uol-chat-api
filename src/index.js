import express, { json } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import joi from 'joi';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
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

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.valid('message', 'private_message').required(),
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

app.get('/participants', async(req, res) => {
  try {
    const { mongoClient, dataBase } = await dbConnect();

    res.send( await dataBase.collection(process.env.USER_COLLECTION).find({}).toArray())
    mongoClient.close();
  } catch (err) {
    res.sendStatus(500);
    console.log(
      `GET userList error: 
      ${err}`
    );
  }
})

app.post('/messages', async(req, res) => {
  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    res.status(422).send(validation.error.details.map(err => err.message));
    return;
  }

  const from = req.headers.user;

  try {
    const { mongoClient, dataBase } = await dbConnect();

    const isUser = await dataBase.collection(process.env.USER_COLLECTION).findOne({ name: from});

    if(isUser){
      await dataBase.collection(process.env.MSG_COLLECTION).insertOne({
        from: from,
        to: req.body.to,
        text: req.body.text,
        type: req.body.type,
        time: dayjs().format("hh:mm:ss"),
       });
      res.sendStatus(201);
      mongoClient.close();
    } else {
      res.status(422).send("Usuário não existente");
    }

  } catch (err) {
    res.sendStatus(500);
    console.log(
      `POST message error: 
      ${err}`
    );
  }
})

app.get('/messages', async(req, res) => {
  const limit = parseInt(req.query.limit);

  try{
    const { mongoClient, dataBase } = await dbConnect();

    const allMessages = await dataBase.collection(process.env.MSG_COLLECTION).find({
      $or:[
        { from: req.headers.user },
        { to: req.headers.user },
        { to: "Todos" },
        { type: "message"}
      ]}).toArray();

    res.send(allMessages.slice(-limit));

    mongoClient.close();
  } catch (err) {
    res.sendStatus(500);
    console.log(
      `GET messages-list error: 
      ${err}`
    );
  }
})

app.post('/status', async(req, res) => {
  try {
    const { mongoClient, dataBase } = await dbConnect();

    const isUser = await dataBase.collection(process.env.USER_COLLECTION).findOne({ name: req.headers.user });

    if(isUser){
      await dataBase.collection(process.env.USER_COLLECTION).updateOne({ _id: isUser._id }, {$set: { lastStatus: Date.now()} } );
      res.sendStatus(200);
      mongoClient.close();
    } else {
      res.status(404).send('Usuário não encontrado');
    }
  } catch (err) {
    res.sendStatus(500);
    console.log(
      `POST status-update error: 
      ${err}`
    );
  }
})

app.listen(5000);