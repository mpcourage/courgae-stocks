-- CreateTable
CREATE TABLE "StockSnapshot" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "prevClose" REAL NOT NULL,
    "change" REAL NOT NULL,
    "changePct" REAL NOT NULL,
    "dayOpen" REAL NOT NULL,
    "dayHigh" REAL NOT NULL,
    "dayLow" REAL NOT NULL,
    "volume" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
