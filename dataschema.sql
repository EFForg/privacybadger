-- Schema for privacy badger data collection

CREATE TABLE IF NOT EXISTS reports (
  report_id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) DEFAULT NULL,
  origin varchar(255) NOT NULL,
  thirdpartynum int(11),
  cookiesentnum int(11),
  cookiereceivednum int(11),
  timestamp DATETIME,
  latest tinyint(1),
  PRIMARY KEY (report_id),
  KEY (origin),
  KEY (latest),
  KEY(timestamp))


) ENGINE=MyISAM DEFAULT CHARSET-UTF8;