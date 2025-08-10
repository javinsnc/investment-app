FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production --legacy-peer-deps
COPY src ./src
ENV PORT=5050
EXPOSE 5050
CMD ["npm","start"]
