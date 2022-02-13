FROM node:16.13.2-alpine

RUN apk update && apk upgrade

WORKDIR /app

COPY package*.json ./

RUN npm install

EXPOSE 8000

COPY . ./
