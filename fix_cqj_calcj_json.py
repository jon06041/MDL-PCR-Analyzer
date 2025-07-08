# Script to fix malformed cqj and calcj fields in WellResult table
# Run this in your Flask shell or as a standalone script

from models import db, WellResult
import json

def fix_json_field(field_value):
    if field_value is None:
        return json.dumps({})
    if isinstance(field_value, dict):
        return json.dumps(field_value)
    if isinstance(field_value, str):
        try:
            parsed = json.loads(field_value)
            if isinstance(parsed, dict):
                return json.dumps(parsed)
            else:
                return json.dumps({})
        except Exception:
            return json.dumps({})
    return json.dumps({})

def fix_all_well_results():
    wells = WellResult.query.all()
    fixed = 0
    for well in wells:
        orig_cqj = well.cqj
        orig_calcj = well.calcj
        new_cqj = fix_json_field(orig_cqj)
        new_calcj = fix_json_field(orig_calcj)
        if orig_cqj != new_cqj or orig_calcj != new_calcj:
            well.cqj = new_cqj
            well.calcj = new_calcj
            fixed += 1
    db.session.commit()
    print(f"Fixed {fixed} WellResult records.")

if __name__ == "__main__":
    from app import app  # Import your Flask app object
    with app.app_context():
        fix_all_well_results()
