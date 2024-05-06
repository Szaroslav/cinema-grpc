#!/bin/bash

mkdir -p src/proto

npx proto-loader-gen-types \
  --grpcLib=@grpc/grpc-js \
  --outDir=src/proto/ \
  ../proto/*.proto
