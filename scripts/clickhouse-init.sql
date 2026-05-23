CREATE DATABASE IF NOT EXISTS policyguard;

CREATE TABLE IF NOT EXISTS policyguard.decisions
(
    decision_id String,
    agent_id String,
    target_name String,
    target_domain String,
    action_type String,
    decision LowCardinality(String),
    risk_level LowCardinality(String),
    matched_rules Array(String),
    cited_md_url String,
    checked_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
ORDER BY (checked_at, decision_id);
