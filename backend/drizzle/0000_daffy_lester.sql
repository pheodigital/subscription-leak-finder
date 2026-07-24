CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"renewal_date" date,
	"billing_cycle" varchar(20),
	"category" varchar(100),
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"source_email_snippet" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
