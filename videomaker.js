/*

VideoMaker.js - a streaming MPEG4 encoder in JavaScript

Using and based on example code from http://bgrins.github.io/videoconverter.js

*/

VideoMaker = (function() {
var worker;
var options;
var running = false;
var isWorkerLoaded = false;
var workerFinishedCallback;
var chunks; // chunks of compressed video
var chunkData; // raw, uncompressed video for chunk
var chunkFrames; // frames in chunkData

function isReady() {
  return !running && isWorkerLoaded;
}

function startRunning() {
  if (options.busyCallback) options.busyCallback(true);
  running = true;
}
function stopRunning() {
  if (options.busyCallback) options.busyCallback(false);
  running = false;
}

function parseArguments(text) {
  text = text.replace(/\s+/g, ' ');
  var args = [];
  // Allow double quotes to not split args.
  text.split('"').forEach(function(t, i) {
    t = t.trim();
    if ((i % 2) === 1) {
      args.push(t);
    } else {
      args = args.concat(t.split(" "));
    }
  });
  return args;
}

function runCommand(text, fileList, callback) {  
  if (isReady()) {
    workerFinishedCallback = callback;
    startRunning();
    var args = parseArguments(text);
    //console.log(args);
    worker.postMessage({
      type: "command",
      arguments: args,
      files : fileList
    });
  }
}

function getDownloadLink(fileData, fileName) {
  if (fileName.match(/\.jpeg|\.gif|\.jpg|\.png/)) {
    var blob = new Blob([fileData]);
    var src = window.URL.createObjectURL(blob);
    var img = document.createElement('img');

    img.src = src;
    return img;
  }
  else {
    var a = document.createElement('a');
    a.download = fileName;
    var blob = new Blob([fileData]);
    var src = window.URL.createObjectURL(blob);
    a.href = src;
    a.textContent = 'Click here to download ' + fileName + "!";
    return a;
  }
}


function initWorker(initCallback) {
  worker = new Worker("worker-asm.js");
  worker.onmessage = function (event) {
    var message = event.data;
    if (message.type == "ready") {
      isWorkerLoaded = true;
      if (initCallback) initCallback();
    } else if (message.type == "stdout") {
      if (options.logCallback) options.logCallback(message.data + "\n");
    } else if (message.type == "start") {
      if (options.logCallback) options.logCallback("Worker has received command\n");
    } else if (message.type == "done") {
      stopRunning();
      var buffers = message.data;
      if (workerFinishedCallback) {
        var c = workerFinishedCallback;
        workerFinishedCallback = undefined;
        c(buffers);
      }
    }
  };
}



var zoom = 1.0;



function init(_options, callback) {
  options = _options||{};
  if (!options.width || !options.height) {
    options.width = 320;
    options.height = 240; 
  }
  options.bpp = options.bpp||3;
  options.framesInChunk = options.framesInChunk||30;
  options.fps = options.fps||30;

  options.ext = "mp4";
  options.encoding = "-c:v libx264";

  chunks = [];
  chunkData = new Uint8Array(options.framesInChunk*options.width*options.height*options.bpp);
  chunkFrames = 0;

  initWorker(callback);
}

function convertChunks(callback) {
  if (!chunkFrames) return callback();
  // we might not be converting all chunks
  var rawData = new Uint8Array(chunkData.buffer, 0, chunkFrames*options.width*options.height*options.bpp);
  chunkFrames = 0;
  runCommand("-f rawvideo -vcodec rawvideo -s "+options.width+"x"+options.height+
             " -pix_fmt rgb"+(options.bpp*8)+" -framerate "+options.fps+" -i input.raw -an "+options.encoding+" output."+options.ext,  // -vf showinfo
             [ { "name": "input.raw", "data": rawData } ], 
             function(files) {
    if (files.length)
      chunks.push(new Uint8Array(files[0].data));
    callback();
  });    
}

function addFrame(data, callback) {
  chunkData.set(data, options.width*options.height*options.bpp*chunkFrames);
  chunkFrames++;
  if (chunkFrames>=options.framesInChunk) {    
    convertChunks(callback);
  } else 
    callback();
}

function getVideoLink(callback) {  
  function combine() {
    var incl = [];
    var filter = [];
    var files = [];
    chunks.forEach(function(data,i) {
      var filename = 'f'+i+'.'+options.ext;
      incl.push('-i '+filename);
      filter.push('['+i+':v]');
      files.push({ name : filename, data : data });
    });
    runCommand(incl.join(" ")+' -filter_complex "'+filter.join(" ")+' concat=n='+filter.length+':v=1:a=0 [v]" -map "[v]" -an '+options.encoding+' output.'+options.ext, 
               files, function(files) {
            console.log("Done");
            chunks = [];
            callback(getDownloadLink(files[0].data, files[0].name));
          });
  }
  convertChunks(combine);
}

return {
  init : init,
  ready : isReady,
  addFrame : addFrame,
  getVideoLink : getVideoLink
};
})();
