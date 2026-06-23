from django.core.exceptions import ValidationError


class WorkAlreadyFinishedError(ValidationError):
    pass


class WorkNotFinishedError(ValidationError):
    pass


class InvoiceAlreadyClosedError(ValidationError):
    pass


class InvoiceAlreadyOpenError(ValidationError):
    pass
