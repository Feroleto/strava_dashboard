-- CreateTable
CREATE TABLE "saved_meals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_meal_items" (
    "id" TEXT NOT NULL,
    "saved_meal_id" TEXT NOT NULL,
    "food_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_meals_user_id_idx" ON "saved_meals"("user_id");

-- CreateIndex
CREATE INDEX "saved_meal_items_saved_meal_id_idx" ON "saved_meal_items"("saved_meal_id");

-- CreateIndex
CREATE INDEX "saved_meal_items_food_id_idx" ON "saved_meal_items"("food_id");

-- AddForeignKey
ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_meal_items" ADD CONSTRAINT "saved_meal_items_saved_meal_id_fkey" FOREIGN KEY ("saved_meal_id") REFERENCES "saved_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_meal_items" ADD CONSTRAINT "saved_meal_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
