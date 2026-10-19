"""Static native-plist validation, not Apple signature or device certification."""
import collections
import plistlib
import re
import uuid


def validate_workflow(data):
    workflow = plistlib.loads(data)
    if not isinstance(workflow, dict):
        raise ValueError("El plist raiz debe ser un diccionario")
    actions = workflow.get("WFWorkflowActions")
    if not isinstance(actions, list) or not actions:
        raise ValueError("Faltan las acciones del atajo")
    outputs = set()
    groups = set()
    stack = []
    identifiers = collections.Counter()

    def check_uuid(value):
        if not isinstance(value, str):
            raise ValueError("UUID no textual")
        uuid.UUID(value)

    def inspect(value):
        if isinstance(value, dict):
            if "OutputUUID" in value:
                if value["OutputUUID"] not in outputs:
                    raise ValueError("Referencia a salida inexistente o futura")
            if value.get("WFSerializationType") == "WFTextTokenString":
                token = value.get("Value", {})
                raw = token.get("string", "").encode("utf-16-le")
                for position in token.get("attachmentsByRange", {}):
                    match = re.fullmatch(r"\{(\d+), (\d+)\}", position)
                    if not match:
                        raise ValueError("Rango de token invalido")
                    start, length = map(int, match.groups())
                    if length != 1 or raw[start * 2:(start + 1) * 2] != b"\xfc\xff":
                        raise ValueError("El rango no apunta al marcador UTF-16")
            for child in value.values():
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)

    for index, action in enumerate(actions):
        if not isinstance(action, dict) or not isinstance(action.get("WFWorkflowActionIdentifier"), str):
            raise ValueError("Accion sin identificador valido")
        identifier = action["WFWorkflowActionIdentifier"]
        parameters = action.get("WFWorkflowActionParameters", {})
        if not isinstance(parameters, dict):
            raise ValueError("Parametros de accion invalidos")
        identifiers[identifier] += 1
        inspect(parameters)
        if "GroupingIdentifier" in parameters:
            group = parameters["GroupingIdentifier"]
            check_uuid(group)
            mode = parameters.get("WFControlFlowMode")
            if mode == 0:
                if group in groups:
                    raise ValueError(f"Identificador de bloque repetido en accion {index + 1}")
                groups.add(group)
                stack.append((group, identifier, False))
            elif mode in (1, 2):
                if not stack or stack[-1][:2] != (group, identifier):
                    raise ValueError(f"Anidacion de bloques invalida en accion {index + 1}")
                if mode == 2:
                    stack.pop()
                elif stack[-1][2]:
                    raise ValueError("Rama alternativa repetida")
                else:
                    stack[-1] = (group, identifier, True)
            else:
                raise ValueError("Modo de control no valido")
        output = parameters.get("UUID")
        if output is not None:
            check_uuid(output)
            if output in outputs:
                raise ValueError(f"UUID de salida repetido en accion {index + 1}")
            outputs.add(output)
    if stack:
        raise ValueError("Bloques sin cerrar")
    for key in ("WFWorkflowClientVersion", "WFWorkflowMinimumClientVersionString"):
        if not isinstance(workflow.get(key), str):
            raise ValueError(f"Metadato invalido: {key}")
    if type(workflow.get("WFWorkflowMinimumClientVersion")) is not int:
        raise ValueError("Version minima no entera")
    serialized = plistlib.dumps(workflow).decode()
    if re.search(r"(?:fp_|pair_)[A-Za-z0-9_-]{43}|postgres(?:ql)?://", serialized):
        raise ValueError("El archivo contiene posibles credenciales")
    return workflow, {
        "actionCount": len(actions), "controlBlockCount": len(groups),
        "uniqueOutputCount": len(outputs), "actionIdentifiers": dict(sorted(identifiers.items())),
        "clientVersion": workflow["WFWorkflowClientVersion"],
        "minimumClientVersion": workflow["WFWorkflowMinimumClientVersion"],
        "staticValidation": "passed", "appleSignatureVerified": False,
        "macImportVerified": False, "physicalIPhoneVerified": False,
    }
