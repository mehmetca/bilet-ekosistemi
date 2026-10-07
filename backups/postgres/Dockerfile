# Coolify'da zamanlanmış Postgres yedeği için kullanılan minimal imaj.
FROM postgres:16-alpine

RUN apk add --no-cache bash

WORKDIR /backup
COPY backup-postgres.sh /usr/local/bin/backup-postgres.sh
RUN chmod 755 /usr/local/bin/backup-postgres.sh

ENTRYPOINT ["/usr/local/bin/backup-postgres.sh"]
