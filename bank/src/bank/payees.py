"""Manage local dictionary of replacements for payees as YAML files."""

from typing import Optional

import re
import yaml
from pathlib import Path
import shutil

from pydantic import BaseModel, Field, PrivateAttr


class PayeeRule(BaseModel):
    pattern: str = Field(
        default=None, description="Regex pattern that matches the payee"
    )
    replacement: Optional[str] = Field(
        default=None,
        description="if present, it will replace the payee, no question asked",
    )
    _regex: re.Pattern = PrivateAttr()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._regex = re.compile(self.pattern, re.IGNORECASE)

    def search(self, payee) -> bool:
        return self._regex.search(payee)


class Payees:
    account: str
    payees_rules: list[PayeeRule] = []
    prefix: Path = Path() / "payees_rules"

    def __init__(self, account: str):
        self.data_file: Path = self.prefix / f"payees_{account.lower()}.yaml"
        self.back_up: Path = self.prefix / f"payees_{account.lower()}.bak"

        try:
            raw_rules = yaml.safe_load(open(self.data_file, "r"))
            self.payees_rules = [PayeeRule(**pr) for pr in raw_rules]
        except (FileNotFoundError, BaseException) as exc:
            if self.data_file.exists():
                print(
                    f"Error in PAYEES file {self.data_file}: saving what I found in {self.back_up}",
                    exc,
                )
                shutil.copy(self.data_file, self.back_up)
            print(f"Creating new in {self.data_file}")
            self.save()

    def show_payees(self):
        """Show a list of all potential payees."""
        uniq = {rule.replacement.lower() for rule in self.payees_rules}
        return input("\n".join(f"[ {rule} ]" for rule in sorted(uniq)) + "\n")

    def save(self):
        """Save regexes to map long payee strings to sensible ones"""
        try:
            with open(self.data_file, "w") as file:
                file.write(yaml.safe_dump([r.dict() for r in self.payees_rules]))

        except Exception as exc:
            print(f"Error saving {self.data_file}", exc)
            raise

    def replace_payee(self, payee: str = "Berliner Sparkasse"):
        for i, rule in enumerate(self.payees_rules):
            if rule.search(payee):
                if rule.replacement:
                    command = input(
                        f"{rule.replacement}? [blank to accept, or type replacement]\n"
                    )
                    if command:
                        rule.replacement = command
                    return rule.replacement
                else:
                    replacement = None
                    while not replacement:
                        replacement = input(f"type a replacement:\n")
                    rule.replacement = replacement
                    return replacement

        words = re.split("([\s]+)", payee)
        replacement = input(
            f"Should be:\n\t"
            + f"1/ {words[0]}\n\t"
            + f"2/ {''.join(words[:3])}\n\t"
            + f"(blank)/ {payee}\n\t"
            + f"?/ list existing payees\n"
        )
        if replacement == "?":
            replacement = self.show_payees()

        if not replacement:
            replacement = payee
        elif replacement == "1":
            replacement = words[0]
        elif replacement == "2":
            replacement = "".join(words[:3])

        pattern = input(
            "Next time...\n"
            f"find with this case insensitive regex {payee}:\n\t"
            + f"1/ {words[0]}\n\t"
            + f"2/ {''.join(words[:3])}\n\t"
            + "(blank)/ don't remember\n"
        )
        if pattern == "1":
            pattern = f"^{words[0]}"
        elif pattern == "2":
            pattern = f"^{''.join(words[:3])}"
        elif pattern == "?":
            print("This is supposed to be a regex to find the payee")

        if pattern:
            try:
                self.payees_rules.append(
                    PayeeRule(
                        pattern=pattern,
                        replacement=replacement,
                    )
                )
            except Exception:
                print("Invalid replacement, nothing added")
        return replacement
