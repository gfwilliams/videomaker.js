VideoMaker.js
=============

*A streaming MPEG4 encoder in JavaScript*

This library uses [videoconverter.js](http://bgrins.github.io/videoconverter.js) to compress raw bytes from JavaScript into a downloadable MPEG4 video.

It's a huge hack based on examples from the videoconverter website, but it allows you to push one frame at a time, and to then retrieve the compressed result.

See [index.html](index.html) for a very hacky example.
