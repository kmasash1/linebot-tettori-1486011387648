/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

// ----------ここから自前コード----------
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var gTbl = {};

function putVal(pKey, key, val){
  var mTbl = gTbl[pKey];
  if(mTbl == 'null'){
    mTbl = {};
    mTbl[key] = val;
    gTbl[pKey] = mTbl;
  }else{
    mTbl[key] = val;
  }
}

function getVal(pKey, key){
  if(gTbl[pKey] == 'null' || gTbl[pKey][key] == 'null'){
    return null;
  }
  return gTbl[pKey][key];
}
// ----------ここまで自前コード----------

// ----------ここから----------
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
// --------ここまで追加--------

// ----------ここから自前コード----------
// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-10-21',
  version: 'v1'
});
// ----------ここまで自前コード----------

// ----------ここから----------
var request = require('request');

app.post('/api', function(req, res) {

  // Extract data from LINE API request
  var body = JSON.parse(req.body); 
  var data = body.events[0];
  if(data.type !== 'message'){
    console.log(data.type);
    return;
  }
  var replyToken = data.replyToken;
  var userId = data.source.userId;
  var message = data.message.text;
  message = message.replace(/\n/g,' ');

  // Set reqest for watson
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var reqStr = JSON.stringify({
    workspace_id: workspace,
    context: getVal(userId, "watson_context"),
    input: {text: message }
  });

  // Send the input to the conversation service
  var resStr = {};
  conversation.message(reqStr, function(err, data) {
    if (err) {
      resStr.status(err.code || 500).json(err);
    }
      resStr.json(updateMessage(reqStr, data));
  });

  /// Watson reply message from conversation
  var res = JSON.stringify({
    replyToken: replyToken,
    messages: [
      {type: "text", text: resStr.output}
  ]});
  
  // Set LINE api access
  var lineOpts = {
    hostname: 'api.line.me',
    path: '/v2/bot/message/reply',
    headers: {
        "Content-type": "application/json; charset=UTF-8",
        "Authorization": "Bearer " + process.env.LINE_TOKEN
    },
    method: 'POST'
  };

  request(lineOpts, function(err, res, body) {
    console.log(JSON.stringify(res));
  });
  res.send('OK');


// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
