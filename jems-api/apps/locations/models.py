from django.db import models


class State(models.Model):
    name = models.CharField(max_length=100)
    abbreviation = models.CharField(max_length=5)

    class Meta:
        db_table = "states"

    def __str__(self) -> str:
        return self.abbreviation


class City(models.Model):
    name = models.CharField(max_length=100)
    zip = models.CharField(max_length=10, blank=True, default="")
    state = models.ForeignKey(
        State, on_delete=models.SET_NULL, null=True, blank=True, related_name="cities"
    )
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "cities"
        ordering = ["name"]
        verbose_name_plural = "cities"

    def __str__(self) -> str:
        return f"{self.name}, {self.state.abbreviation if self.state else ''}"
