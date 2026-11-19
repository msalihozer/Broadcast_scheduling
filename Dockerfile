# ==============================================================================
# Yayın Planlama Sistemi - Tam Entegre (Frontend + Backend + FFmpeg + Python3) Dockerfile
# ==============================================================================
FROM node:20-alpine

# 1. Video önizleme (/api/stream) için FFmpeg, Excel içe aktarma için Python3 & openpyxl kurulumu
RUN apk add --no-cache ffmpeg tzdata python3 py3-openpyxl && \
    ln -sf /usr/bin/python3 /usr/bin/python

ENV TZ=Europe/Istanbul

WORKDIR /app

# 2. Bağımlılıkları yükle (Docker katman önbelleklemesi için önce package*.json)
COPY package*.json ./
RUN npm install

# 3. Kaynak kodları kopyala ve Frontend'i (dist/) derle
COPY . .
RUN npm run build

# 4. Medya arşiv mount ve kalıcı veri dizinlerini oluştur
RUN mkdir -p /mnt/media_highres /mnt/media_archive /app/backend/data

EXPOSE 3001 5173

# Varsayılan olarak hem Vite (5173) hem Backend API & Static (3001) çalışır
CMD ["npm", "run", "dev"]

