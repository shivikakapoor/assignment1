require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 12;

const mongoUri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DATABASE}`;

let userCollection;

async function connectDB() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE);
  userCollection = db.collection('users');
  console.log('Connected to MongoDB');
}
connectDB();

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
  secret: process.env.NODE_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    dbName: process.env.MONGODB_DATABASE,
    collectionName: 'sessions'
  }),
  cookie: { maxAge: 60 * 60 * 1000 }
}));

// Home
app.get('/', (req, res) => {
  if (req.session.user) {
    res.send(`
      <h1>Hello, ${req.session.user.name}!</h1>
      <a href="/members"><button>Go to Members Area</button></a><br><br>
      <a href="/logout"><button>Logout</button></a>
    `);
  } else {
    res.send(`
      <h1>Home</h1>
      <a href="/signup"><button>Sign up</button></a><br><br>
      <a href="/login"><button>Log in</button></a>
    `);
  }
});

// Signup GET
app.get('/signup', (req, res) => {
  res.send(`
    <h2>create user</h2>
    <form action="/signupSubmit" method="POST">
      <input name="name" placeholder="name" /><br>
      <input name="email" placeholder="email" /><br>
      <input name="password" type="password" placeholder="password" /><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

// Signup POST
app.post('/signupSubmit', async (req, res) => {
  const { name, email, password } = req.body;

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(50).required()
  });

  const { error } = schema.validate({ name, email, password });
  if (error) {
    return res.send(`<p>${error.details[0].message}</p><a href="/signup">Try again</a>`);
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({ name, email, password: hashedPassword });
  req.session.user = { name, email };
  res.redirect('/members');
});

// Login GET
app.get('/login', (req, res) => {
  res.send(`
    <h2>log in</h2>
    <form action="/loginSubmit" method="POST">
      <input name="email" placeholder="email" /><br>
      <input name="password" type="password" placeholder="password" /><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

// Login POST
app.post('/loginSubmit', async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().max(50).required()
  });

  const { error } = schema.validate({ email, password });
  if (error) {
    return res.send(`<p>Invalid input.</p><a href="/login">Try again</a>`);
  }

  const user = await userCollection.findOne({ email });
  if (!user) {
    return res.send(`<p>Invalid email/password combination.</p><a href="/login">Try again</a>`);
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.send(`<p>Invalid email/password combination.</p><a href="/login">Try again</a>`);
  }

  req.session.user = { name: user.name, email: user.email };
  res.redirect('/members');
});

// Members
app.get('/members', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  const images = ['img1.jpg', 'img2.jpg', 'img3.jpg'];
  const randomImg = images[Math.floor(Math.random() * images.length)];
  res.send(`
    <h1>Hello, ${req.session.user.name}.</h1>
    <img src="/${randomImg}" width="300" /><br><br>
    <a href="/logout"><button>Sign out</button></a>
  `);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// 404
app.get('*splat', (req, res) => {
  res.status(404).send('<h1>Page not found - 404</h1>');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));