from django.core.exceptions import ValidationError


class InvalidStatusTransition(ValidationError):
    pass


class LoadAlreadyAssigned(ValidationError):
    pass
