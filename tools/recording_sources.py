"""Resolve archived conditions without inferring perturbations from axis names."""
import csv
import math


def condition(row):
    axis = row.get('axis')
    factor = row.get('factor')
    if not axis or axis == 'nan' or not factor or factor == 'nan':
        parsed_axis, token = row['scenario_label'].rsplit('_', 1)
        parsed_factor = float(token.removeprefix('m').replace('p', '.'))
        if token.startswith('m'):
            parsed_factor = -parsed_factor
        axis = axis if axis and axis != 'nan' else parsed_axis
        factor = factor if factor and factor != 'nan' else parsed_factor
    value = float(factor)
    if not math.isfinite(value):
        raise ValueError('Nonfinite perturbation severity')
    return axis, value


def archived_rows(root, study):
    with (root / study['source']).open() as stream:
        for row in csv.DictReader(stream):
            if row['env_id'] == study['environment'] and row['model_label'] in study['models']:
                yield row


def policy_candidates(root, study):
    """Choose the smallest seed covering every displayed condition, not by return."""
    expected = {model: {(axis['id'], float(point['x']))
        for axis in study['axes'] for point in axis['curves'].get(model, [])}
        for model in study['models']}
    candidates = {}
    for row in archived_rows(root, study):
        key = row['model_label'], int(row['seed'])
        candidate = candidates.setdefault(key, dict(conditions=set(), row=row, paths=set()))
        candidate['conditions'].add(condition(row))
        candidate['paths'].add((row['algo'], row['model_path'], row.get('norm_stats_path', '')))
        if float(row['timestamp']) < float(candidate['row']['timestamp']):
            candidate['row'] = row
    result = {}
    for model in study['models']:
        eligible = [(seed, candidate) for (label, seed), candidate in candidates.items()
            if label == model and len(candidate['paths']) == 1
            and expected[model] <= candidate['conditions']]
        if not eligible:
            raise ValueError(f"No single archived policy covers {study['id']}/{model}")
        seed, candidate = min(eligible, key=lambda pair: pair[0])
        result[model] = seed, candidate['row']
    return result
