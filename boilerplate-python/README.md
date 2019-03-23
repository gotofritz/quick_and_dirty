# Python boilerplate project

The simplest of setup for python

```
├── Dockerfile
├── requirements.txt
└── src
    └── main.py
```

Build the image with `docker build -t app .`
Then run it with `docker run -it --rm --name running-app app`

Or run it directly without building, with
```
docker run -it --rm --name running-app -v "$PWD":/usr/src/myapp -w /usr/src/myapp python:3.7.2-alpine3.9 src/main.py
```