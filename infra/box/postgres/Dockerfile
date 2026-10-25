FROM postgres:17-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    cron \
    age \
    awscli \
    && curl -fsSL https://github.com/wal-g/wal-g/releases/download/v3.0.5/wal-g-pg-ubuntu-20.04-amd64.tar.gz \
       | tar -xz -C /usr/local/bin \
    && mv /usr/local/bin/wal-g-pg-ubuntu-20.04-amd64 /usr/local/bin/wal-g \
    && chmod +x /usr/local/bin/wal-g \
    && rm -rf /var/lib/apt/lists/*

COPY backup-nightly.sh /usr/local/bin/backup-nightly.sh
RUN chmod +x /usr/local/bin/backup-nightly.sh \
    && echo "0 3 * * * root /usr/local/bin/backup-nightly.sh >> /var/log/pand-backup.log 2>&1" > /etc/cron.d/pand-backup \
    && chmod 0644 /etc/cron.d/pand-backup
