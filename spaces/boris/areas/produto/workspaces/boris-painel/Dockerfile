FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vars VITE_* são injetadas no build via build-args do EasyPanel
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_URL
ARG VITE_APP_URL

# Disponibiliza no ambiente do build para o Vite
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_APP_URL=$VITE_APP_URL \
    BROWSERSLIST_IGNORE_OLD_DATA=1

RUN npm run build -- --logLevel error

FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
