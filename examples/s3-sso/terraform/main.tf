# A private S3 bucket holding a biac `build/`, and a read-only IAM user for
# the signing proxy in front of it. Everything below the provider block is
# what a deployer applies to real AWS; only the provider block points at moto.

terraform {
  required_version = "= 1.17.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.70.0"
    }
  }
}

variable "aws_endpoint" {
  description = "moto's address on the compose network. Drop the endpoints block and the skip_* flags to apply against real AWS."
  type        = string
  default     = "http://moto:5000"
}

variable "site_dir" {
  description = "The output of `biac build`, mounted read-only."
  type        = string
  default     = "/site"
}

variable "bucket_name" {
  type    = string
  default = "biac-site"
}

provider "aws" {
  region = "us-east-1"

  # moto has no instance metadata, no STS account lookup and no virtual-host
  # DNS, per the provider's custom-service-endpoints guide.
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3  = var.aws_endpoint
    iam = var.aws_endpoint
    sts = var.aws_endpoint
  }
}

resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Recorded for parity with a real bucket; moto stores it but serves no index
# or error document, so the proxy in front rewrites directory paths itself.
resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

resource "aws_iam_user" "reader" {
  name = "biac-site-reader"
}

resource "aws_iam_user_policy" "reader" {
  name = "read-site-objects"
  user = aws_iam_user.reader.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.site.arn}/*"
    }]
  })
}

resource "aws_iam_access_key" "reader" {
  user = aws_iam_user.reader.name
}

locals {
  # Every extension `biac build` emits. A file outside this map fails the
  # plan rather than being served as binary/octet-stream.
  content_types = {
    css     = "text/css; charset=utf-8"
    csv     = "text/csv; charset=utf-8"
    html    = "text/html; charset=utf-8"
    js      = "text/javascript; charset=utf-8"
    parquet = "application/vnd.apache.parquet"
    svg     = "image/svg+xml"
    wasm    = "application/wasm"
  }
}

resource "aws_s3_object" "site" {
  for_each = fileset(var.site_dir, "**")

  bucket       = aws_s3_bucket.site.id
  key          = each.value
  source       = "${var.site_dir}/${each.value}"
  content_type = local.content_types[regex("[^.]+$", each.value)]

  # Not `etag`: files over the multipart threshold (the DuckDB wasm bundles)
  # store a multipart ETag that never equals their MD5, so every re-plan
  # would show drift. See the provider's aws_s3_object docs.
  source_hash = filemd5("${var.site_dir}/${each.value}")
}

output "reader_access_key_id" {
  value = aws_iam_access_key.reader.id
}

output "reader_secret_access_key" {
  value     = aws_iam_access_key.reader.secret
  sensitive = true
}
