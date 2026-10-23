-- Reference only: the app creates these tables itself on first use (CREATE TABLE IF NOT EXISTS).

-- Key/value store: the shared word library ("library") and the used-pair history ("used_pairs").
CREATE TABLE IF NOT EXISTS sw_kv (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v LONGTEXT NOT NULL,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per room. `session` is the full game state (secrets included; never sent to phones as-is).
CREATE TABLE IF NOT EXISTS sw_rooms (
  code CHAR(4) NOT NULL PRIMARY KEY,
  status VARCHAR(10) NOT NULL DEFAULT 'lobby',   -- lobby | playing
  config LONGTEXT NOT NULL,                      -- lobby settings (JSON)
  session LONGTEXT NULL,                         -- GameSession (JSON) while playing
  ready LONGTEXT NOT NULL,                       -- player ids that confirmed their word (JSON array)
  version INT NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  KEY idx_rooms_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per phone/player. `token` is the player's secret credential (stored in their browser).
CREATE TABLE IF NOT EXISTS sw_room_players (
  room_code CHAR(4) NOT NULL,
  player_id CHAR(36) NOT NULL,
  name VARCHAR(24) NOT NULL,
  name_key VARCHAR(100) NOT NULL,                -- normalised name, unique per room
  token CHAR(48) NOT NULL,
  is_host TINYINT(1) NOT NULL DEFAULT 0,
  joined_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  PRIMARY KEY (room_code, player_id),
  UNIQUE KEY uq_room_name (room_code, name_key),
  UNIQUE KEY uq_token (token),
  CONSTRAINT fk_sw_room FOREIGN KEY (room_code) REFERENCES sw_rooms (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
