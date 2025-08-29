#!/usr/bin/env bash
export DATABASE_URL=${DATABASE_URL:-postgres://app_user:***@127.0.0.1:5432/yourdb}
./deploy/deploy-phase2.sh
