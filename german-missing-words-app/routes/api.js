const express = require('express');
const router = express.Router();
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const dbUrl = 'mongodb://localhost:27017/';
const dbName = 'german-missing-words';
const assert = require('assert');

/* GET users listing. */
router.get('/', function(req, res) {
  MongoClient.connect(dbUrl, { useNewUrlParser: true }, function(err, client) {
    assert.equal(null, err);
    console.log('Connected successfully to server');
    const db = client.db(dbName);

    db
      .collection('articles')
      .aggregate([{ $sample: { size: 1 } }])
      .toArray(function(err, articles) {
	console.log(articles);
	const article = articles[0];
	if (err) throw err;
	res.json({
	  _id: article._id,
	  title: article.title,
	  fillers: article.fillers,
	  text: article.text,
	});
	client.close();
      });
  });
});

module.exports = router;
