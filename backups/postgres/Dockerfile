# Coolify'da zamanlanmış Postgres yedeği için kullanılan minimal imaj.
# pg_dump, sunucudan eskiyse dökümü reddediyor; Supabase PG17 açabildiği için istemci 17.
FROM postgres:17-alpine

RUN apk add --no-cache bash musl-utils gzip

WORKDIR /backup
COPY backup-postgres.sh /usr/local/bin/backup-postgres.sh
RUN chmod 755 /usr/local/bin/backup-postgres.sh

ENTRYPOINT ["/usr/local/bin/backup-postgres.sh"]
