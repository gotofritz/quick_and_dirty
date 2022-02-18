import pandas as pd

df = pd.read_csv(r"/Users/fs740y/Downloads/org_browsers.csv")
column_list = df.columns.tolist()
del column_list[4], column_list[0]
df = df[column_list]
for num, row in df.iterrows():
    print(f"{row[0]} {row[1]} - {row[2]}")
