FROM node:11.12.0-alpine

WORKDIR /usr/src/app

COPY package.json ./
RUN yarn

COPY src/ .

CMD [ "node", "./index.js" ]
