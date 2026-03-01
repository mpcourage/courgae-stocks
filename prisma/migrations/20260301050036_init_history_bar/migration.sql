-- CreateTable
CREATE TABLE "HistoryBar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "HistoryBar_symbol_date_idx" ON "HistoryBar"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryBar_symbol_date_key" ON "HistoryBar"("symbol", "date");
