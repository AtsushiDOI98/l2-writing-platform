-- CreateTable
CREATE TABLE "public"."Assignment" (
    "studentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("studentId")
);

CREATE UNIQUE INDEX "Assignment_seq_key" ON "public"."Assignment"("seq");

-- 学籍番号ごとに条件を1回だけ割り振る関数。
-- アドバイザリロックで同時実行を直列化し、登録済みなら同じ条件を返す。
-- seq は既存の割り振り件数 + 1 なので欠番が出ず、3条件が順番に回る。
CREATE OR REPLACE FUNCTION "public"."assign_condition"(sid TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  result TEXT;
  n INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('assign_condition'));

  SELECT "condition" INTO result FROM "public"."Assignment" WHERE "studentId" = sid;
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  SELECT count(*) INTO n FROM "public"."Assignment";
  result := (ARRAY['control', 'model text', 'ai-wcf'])[n % 3 + 1];

  INSERT INTO "public"."Assignment" ("studentId", "seq", "condition")
  VALUES (sid, n + 1, result);

  RETURN result;
END;
$$;
