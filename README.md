## CytoBrowser
===========

Fork of [TissUUmaps](https://github.com/wahlby-lab/TissUUmaps) aimed at Cytology

1. Handling focus-stacks
2. Point annotations
3. Server side annotations (future)
4. Multi-user shared view (future)


#### Example
```
#Install the necessary dependencies
npm install

#Start the web server on a specified host
node cytobrowser.js 127.0.0.1 8080

#Or more generally
node cytobrowser.js [hostname] [port]

#Optionally open an ssh-pipe from your local machine to the web server
ssh -L 8080:localhost:8080 remote.host

#Open browser on your local machine
$BROWSER http://localhost:8080/?image=filename

#Enjoy! =)
```
