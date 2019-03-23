# Node.js boilerplate project

The simplest of setup for node

```
boilerplate-node/
├── .eslintrc.json
├── .prettierrc
├── Dockerfile
├── README.md
├── package.json
├── requirements.txt
├── src
│  ├── __tests__
│  │  └── index.test.js
│  └── index.js
├── yarn-error.log
└── yarn.lock
```

Build the image with `docker build -t app-node .`
Then run it with `docker run -it --rm --name running-app-node app-node`

Or run it directly without building, with
```
docker run -it --rm --name running-app -v "$PWD":/usr/src/myapp -w /usr/src/myapp node:11.12.0-alpine src/index.js
```