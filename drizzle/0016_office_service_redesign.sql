ALTER TABLE activities ADD COLUMN needs_venue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN venue_request_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE venue_requests (
  id TEXT PRIMARY KEY,status TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'manual',requester_username TEXT NOT NULL,requester_name TEXT NOT NULL,requester_department TEXT NOT NULL,
  title TEXT NOT NULL,purpose_category TEXT NOT NULL DEFAULT '',usage_departments_json TEXT NOT NULL DEFAULT '[]',usage_date TEXT NOT NULL DEFAULT '',start_time TEXT NOT NULL DEFAULT '',end_time TEXT NOT NULL DEFAULT '',attendee_count INTEGER NOT NULL DEFAULT 0,
  room_types_json TEXT NOT NULL DEFAULT '[]',equipment_json TEXT NOT NULL DEFAULT '[]',preferred_location TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',attachments_json TEXT NOT NULL DEFAULT '[]',
  activity_id TEXT NOT NULL DEFAULT '',activity_name TEXT NOT NULL DEFAULT '',confirmed_room TEXT NOT NULL DEFAULT '',confirmed_date TEXT NOT NULL DEFAULT '',confirmed_start_time TEXT NOT NULL DEFAULT '',confirmed_end_time TEXT NOT NULL DEFAULT '',
  office_attachments_json TEXT NOT NULL DEFAULT '[]',handling_note TEXT NOT NULL DEFAULT '',handler_name TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_venue_requests_status ON venue_requests(status,updated_at);
CREATE UNIQUE INDEX idx_venue_requests_activity ON venue_requests(activity_id) WHERE activity_id <> '';
CREATE TABLE venue_request_events (id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL,action TEXT NOT NULL,from_status TEXT NOT NULL,to_status TEXT NOT NULL,actor_name TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_venue_request_events_request ON venue_request_events(request_id,id);

CREATE TABLE meeting_rounds (id TEXT PRIMARY KEY,title TEXT NOT NULL,meeting_date TEXT NOT NULL DEFAULT '',deadline TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,department_names_json TEXT NOT NULL DEFAULT '[]',created_by_name TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_meeting_rounds_status ON meeting_rounds(status,updated_at);
CREATE TABLE meeting_reports (id TEXT PRIMARY KEY,round_id TEXT NOT NULL,department TEXT NOT NULL,status TEXT NOT NULL,last_week TEXT NOT NULL DEFAULT '',this_week TEXT NOT NULL DEFAULT '',notice_count INTEGER NOT NULL DEFAULT 0,media_count INTEGER NOT NULL DEFAULT 0,email_received INTEGER NOT NULL DEFAULT 0,email_sent INTEGER NOT NULL DEFAULT 0,meeting_attendance INTEGER NOT NULL DEFAULT 0,meeting_duration TEXT NOT NULL DEFAULT '',unplanned_workload TEXT NOT NULL DEFAULT '',submitted_by TEXT NOT NULL DEFAULT '',reviewed_by TEXT NOT NULL DEFAULT '',review_note TEXT NOT NULL DEFAULT '',submitted_at TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(round_id,department));
CREATE INDEX idx_meeting_reports_round ON meeting_reports(round_id,status);
CREATE TABLE meeting_report_events (id INTEGER PRIMARY KEY AUTOINCREMENT,report_id TEXT NOT NULL,action TEXT NOT NULL,from_status TEXT NOT NULL,to_status TEXT NOT NULL,actor_name TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_meeting_report_events_report ON meeting_report_events(report_id,id);
CREATE TABLE meeting_exports (id TEXT PRIMARY KEY,round_id TEXT NOT NULL,object_key TEXT NOT NULL,file_name TEXT NOT NULL,missing_mode TEXT NOT NULL DEFAULT 'omit',generated_by TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_meeting_exports_round ON meeting_exports(round_id,created_at);
