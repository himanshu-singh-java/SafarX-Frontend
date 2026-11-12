FROM node:20-alpine as build
WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_API_URL=https://safarx-ridehailingbackend-production.up.railway.app
ARG VITE_RAZORPAY_KEY_ID=""
ARG VITE_DEMO_MODE="true"

# Expose to Vite build process
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

RUN sed -i 's/index  index.html index.htm;/index  index.html index.htm;\n        try_files $uri $uri\/ \/index.html;/g' /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
