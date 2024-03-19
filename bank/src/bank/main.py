"""Make CSVs generated by the Berliner Sparkasse usable to YNAB.

It keeps a local map of payees per user so that you can reuse them. They
are very specific file formats, so this is probably of no use to anyone
else.

Usage: python src/bank/main.py [USER] /path/to/a/file.CSV
"""

import pandas as pd
import re
from typing import Optional

from typing_extensions import Annotated
from pathlib import Path
from typer import Argument, Typer
from datetime import datetime

from bank.payees import Payees

app = Typer()


@app.command()
def main(
    account: Annotated[Optional[str], Argument(help="she or he or any other shortcut")],
    src: Annotated[str, Argument(help="The path to a CSV file")],
    target: Annotated[
        Optional[str], Argument(help="The path to the generated CSV file")
    ] = "./upload_me.csv",
):
    """Converts one or more csv to a YNAB fiendly version.

    Args:
        src (str, optional): _description_. Defaults to Argument( ...,
        help="The path to a CSV file"
        ).
        target (Optional[str], optional): _description_. Defaults to
        Option( "./upload_me.csv", help="The path to the generated CSV
        file" ).
    """
    payees_rules = Payees(account=account)
    generated_df = pd.DataFrame()

    # My bank generates CSVs in different formats for differet types of
    # accounts
    field_names = {
        "BERLINER": {
            "Date": "Buchungstag",
            "Payee": "Beguenstigter/Zahlungspflichtiger",
            "Memo": "Verwendungszweck",
            "Amount": "Betrag",
            "Info": "Info",
        },
        "CREDIT": {
            "Date": "Buchungsdatum",
            "Payee": "Transaktionsbeschreibung",
            "Memo": "Gebührenschlüssel",
            "Amount": "Buchungsbetrag",
            "Info": "Länderkennzeichen",
        },
    }

    src_path = Path(src)
    if not src_path.is_file():
        print(f"This scripts needs a CSV file, is this a directory? {src}")
        exit(1)

    # One way to recognize the account type is that the CSV for credit
    # card accounts are in the format
    # umsatz-4208________2905-20240319.CSV
    if "_______" in src_path.as_posix():
        fields_map = field_names["CREDIT"]
    else:
        fields_map = field_names["BERLINER"]

    try:
        df = pd.read_csv(src_path, sep=";", encoding="ISO-8859-1")

        transformed_df = pd.DataFrame().assign(
            Date=df[fields_map["Date"]].map(
                lambda datum: datetime.strftime(
                    datetime.strptime(datum, "%d.%m.%y"),
                    "%m/%d/%y",
                )
            ),
            Payee=df[fields_map["Payee"]].fillna(""),
            Memo=df[fields_map["Memo"]],
            Amount=df[fields_map["Amount"]].map(
                lambda amount: amount.replace(",", ".")
            ),
            Info=df[fields_map["Info"]],
        )

        # remove future payments, which mess up everything
        transformed_df = transformed_df[transformed_df["Info"] != "Umsatz vorgemerkt"]

        generated_df = pd.concat([generated_df, transformed_df], axis=0)
    except BaseException as exc:
        print(f"Could not read {src_path}", exc)

    for index, row in generated_df.iterrows():
        cleanedup_payee = re.sub(r" {2,}", " ", row["Payee"]).strip()
        also_show = f"/ {row['Amount']} / {row['Memo']}"
        print("-----------------------")
        print(cleanedup_payee, also_show)
        row["Payee"] = payees_rules.replace_payee(cleanedup_payee)
        generated_df.loc[index] = row

    generated_df.to_csv(target, sep=",", encoding="utf-8", index=False)
    payees_rules.save()
    print(f"Generated {target}")


if __name__ == "__main__":
    app()

    """Date,Payee,Memo,Amount
06/22/21,Payee 1,Memo,-100.00
06/22/21,Payee 2,Memo,500.00
    """
