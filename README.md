## CytoBrowser
===========

Fork of [TissUUmaps](https://github.com/wahlby-lab/TissUUmaps) aimed at Cytology 

1. Handling focus-stacks
2. Point annotations
3. Server side annotations (future)
4. Multi-user shared view (future)


#### Example
```
#Start web server on local or remote host, serving on localhost
python -m http.server 8080 --bind 127.0.0.1

#Optionally open an ssh-pipe from your local machine to the web server
ssh -L 8080:localhost:8080 remote.host

#Open browser on your local machine
$BROWSER http://localhost:8080/?image=filename

#Enjoy! =)
```

