-- Run once as the MariaDB admin:  sudo mariadb < db/init.sql
-- Creates the database and a dedicated user for Shadow Words.
-- CHANGE THE PASSWORD below and put the same one in .env.local (DB_PASSWORD).
CREATE DATABASE IF NOT EXISTS shadow_words CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'shadow'@'localhost' IDENTIFIED BY 'change-me';
CREATE USER IF NOT EXISTS 'shadow'@'127.0.0.1' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON shadow_words.* TO 'shadow'@'localhost';
GRANT ALL PRIVILEGES ON shadow_words.* TO 'shadow'@'127.0.0.1';
FLUSH PRIVILEGES;
-- The app creates its tables itself on first start (see db/schema.sql for reference).
