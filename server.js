const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

//DB
mongoose.connect(process.env.DATABASE_CLOUD, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('DB connected'))
    .catch((err) => console.log("DB error =>", err));

// import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

//app middlewares
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(cors({ origin: process.env.CLIENT_URL }));

// middlewares
app.use('/api', authRoutes);
app.use('/api', userRoutes);

const port = process.env.PORT;

app.listen(port, () => console.log(`API is running on port ${port}`));
