var express = require('express');
var app = express();
var cheerio =  require("cheerio");
var request = require("request");
var path = require('path');
var bodyParser = require('body-parser');
var natural = require("natural");
  TfIdf = natural.TfIdf,
  NGrams = natural.NGrams,
  nounInflector = new natural.NounInflector();
  tfidf = new TfIdf();
var pos = require('pos');

var stopWords = require('stopwords').english;
require('events').EventEmitter.prototype._maxListeners = 100;

var tempURL = "https://www.gutenberg.org/files/1342/1342-h/1342-h.htm";
var book = "";

var charsToSig = new Map();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.post('/myaction', function(req, res){
  var sq = req.body.input.split(' ').join('+');;
  var sqUrl = "https://www.gutenberg.org/ebooks/search/?query=" + sq;
  console.log(sqUrl);
  request(sqUrl, function(error, response, html){
    var $ = cheerio.load(html);
    $("a").each(function(ix, element) {
      if (typeof element.attribs.href != 'undefined' && (element.attribs.href.indexOf("search") < 0)) {
        preUrl = "https://www.gutenberg.org" + element.attribs.href
        var urlNum = preUrl.substring(preUrl.lastIndexOf("/") + 1, preUrl.length)
        var url = "http://www.gutenberg.org/files/" + urlNum + "/" + urlNum + "-h/"+ urlNum + "-h.htm"
        console.log(url);
        sendRequest(url, req, res);
        return false;
      }
    })
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

function sendRequest(url, req, res){
  request(url, function(error, response, html){
    if(!error && response.statusCode == 200){
      var $ = cheerio.load(html);
      $("p").each(function(ix, element) {
        if (typeof element.children[0].data != 'undefined') {
          var cleanData = element.children[0].data.replace(/(\r\n|\n|\r|\t|    )/gm,"");
          // console.log(cleanData);
          if (cleanData.length > 0) {
             book = book + cleanData;
          }
        }
      })

      book = book.replace(/[.,\/#!?$%\^&\*;:{}=\_`~()’"“”]/g,"");
      book = book.replace(/[-—]/g," ");
      // book = book.toLowerCase();

      diagramBook = NGrams.bigrams(book);

      var words = new pos.Lexer().lex(book);
      var tagger = new pos.Tagger();
      var taggedWords = tagger.tag(words);

      importantWords = "";

      for (var i = 0; i < taggedWords.length - 1; i++) {
        var taggedWord1 = taggedWords[i];
        var word1 = taggedWord1[0];
        var tag1 = taggedWord1[1];
        var taggedWord2 = taggedWords[i+1];
        var word2 = taggedWord2[0];
        var tag2 = taggedWord2[1];
        word1 = nounInflector.singularize(word1)
        word2 = nounInflector.singularize(word2)
        if(word1.startsWith('Mr') || word1.startsWith('Miss') && tag2 == "NNP"){
          word1 = word1 +". "+ word2;
        }
        if(tag1 == 'NNP' && word1 != "Ill"){
          if (charsToSig.has("Mr. " + word1)) {
            word1 = "Mr. "+ word1;
          }
          if (charsToSig.has("Mrs. " + word1)) {
            word1 = "Mrs. "+ word2;
          }
          if(charsToSig.has(word1)){
            var freq = charsToSig.get(word1) + 1;
            charsToSig.set(word1, freq);
          }
          else{
            var freq = 1;
            charsToSig.set(word1, freq)
          }
        }
      }

      a = [];
      for(var x of charsToSig)
        a.push(x);

      a.sort(function(x, y) {
        return y[1] - x[1];
      });

      // console.log(a);
      characters = "";
      for (var i = 0; i < 5; i++) {
        if (i < 4) {
          characters += a[i][0] + ", "
        }
        else {
          characters += "and " + a[i][0] + "."
        }
      }

      console.log("The 5 most significant/locations characters are: " + characters);
      res.send("The 5 most significant/locations characters are: " + characters);
      trigramBook = NGrams.trigrams(book);
    }
    else {
      res.send("Not in my database! Sorry!");
    }
  });
}
