FROM node:dubnium
LABEL org.opencontainers.image.source https://github.com/aura-nw/multisig-sync

ARG PORT=3000

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . .
RUN npm install && npm cache clean --force
RUN npm run build

EXPOSE $PORT

CMD [ "npm", "run", "start" ]
