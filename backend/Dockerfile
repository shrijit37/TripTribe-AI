FROM node:20.19.2

WORKDIR /app

COPY package.json .

RUN npm install --force

COPY . .

EXPOSE 8080

CMD ["npm", "start"]