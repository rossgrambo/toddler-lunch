# Sample Data for Google Sheets

Copy and paste this sample data into your Google Sheets to get started quickly.

## Items Sheet Sample Data

```
Item,Tags,Carb,Protein,Fruit,Veggie,Last Used,difficulty
Oatmeal,breakfast,y,,,08/10/2025,1
Greek Yogurt,snack,,y,,,08/11/2025,
Banana,snack,,,y,,08/09/2025,
Blueberries,snack,,,y,,08/12/2025,2
Whole Wheat Toast,breakfast,y,,,08/08/2025,1
Peanut Butter,snack,,y,,,08/13/2025,3
Apple Slices,snack,,,y,,08/07/2025,1
Carrots,snack,,,,y,08/14/2025,
Hummus,snack,,y,,,08/06/2025,2
Macaroni & Cheese,meal,y,y,,,08/05/2025,4
Grilled Chicken,meal,,y,,,08/11/2025,5
Sweet Potato,meal,y,,,y,08/09/2025,3
Broccoli,meal,,,,y,08/10/2025,2
Rice,meal,y,,,08/12/2025,1
```

## Schedule Sheet Sample Data

```
Name,Time,Carb,Fruit,Protein,Veggie
Morning Snack,9:00:00 AM,,,y,
Lunch,12:00:00 PM,y,,y,y
Afternoon Snack,3:00:00 PM,,,y,
Dinner,6:00:00 PM,y,,y,y
Evening Snack,8:00:00 PM,,y,,
```

## Grocery Sheet Sample Data

```
Need
strawberries
milk
bread
```

## Notes

- Leave `current` and `history` sheets empty initially - the app will populate them
- The `current` sheet will have this structure when populated:
  ```
  date,meal name,item 1,item 2,item 3,item 4
  08/14/2025,Morning Snack,Greek Yogurt,,,
  08/14/2025,Lunch,Macaroni & Cheese,Broccoli,,
  ```
- Adjust the schedule times and requirements to match your needs
- Add more items to the `items` sheet as needed
- The "Last Used" dates should be varied to test the least-recently-used algorithm
- Make sure to use "y" (lowercase) for category markers, not "Y" or "yes"
